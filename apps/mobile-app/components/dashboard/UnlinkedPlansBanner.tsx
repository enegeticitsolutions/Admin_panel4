import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';

interface UnlinkedPlansBannerProps {
    unlinkedCount: number;
    packageName?: string;
    onAssignPress: () => void;
}

export const UnlinkedPlansBanner: React.FC<UnlinkedPlansBannerProps> = ({
    unlinkedCount,
    packageName,
    onAssignPress,
}) => {
    if (unlinkedCount <= 0) return null;

    return (
        <View style={styles.card}>
            <View style={styles.header}>
                <View style={styles.iconBox}>
                    <Feather name="user-plus" size={20} color="#EA580C" />
                </View>
                <View style={styles.textWrap}>
                    <View style={styles.titleRow}>
                        <Text style={styles.title}>
                            {unlinkedCount} Unlinked Care {unlinkedCount === 1 ? 'Plan' : 'Plans'}
                        </Text>
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>Action Needed</Text>
                        </View>
                    </View>
                    <Text style={styles.subtitle}>
                        {unlinkedCount === 1
                            ? `Assign ${packageName || 'your care plan'} to a family member to activate care visits.`
                            : `You have ${unlinkedCount} care plans ready to assign to family members.`}
                    </Text>
                </View>
            </View>

            <TouchableOpacity
                style={styles.actionBtn}
                onPress={onAssignPress}
                activeOpacity={0.85}
            >
                <Feather name="user-check" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.actionBtnText}>
                    {unlinkedCount === 1 ? 'Assign Beneficiary' : 'Assign Care Plans'}
                </Text>
                <Feather name="arrow-right" size={14} color="#FFFFFF" style={{ marginLeft: 6 }} />
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#FFF7ED',
        borderRadius: 18,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1.5,
        borderColor: '#FFEDD5',
        shadowColor: '#EA580C',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    iconBox: {
        width: 42,
        height: 42,
        borderRadius: 12,
        backgroundColor: '#FFEDD5',
        justifyContent: 'center',
        alignItems: 'center',
    },
    textWrap: {
        flex: 1,
        marginLeft: 12,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap',
    },
    title: {
        fontFamily: 'Poppins-Bold',
        fontSize: 15,
        color: '#9A3412',
    },
    badge: {
        backgroundColor: '#FEE2E2',
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 6,
    },
    badgeText: {
        fontFamily: 'Poppins-Medium',
        fontSize: 10,
        color: '#DC2626',
    },
    subtitle: {
        fontFamily: 'Poppins-Regular',
        fontSize: 12,
        color: '#7C2D12',
        lineHeight: 17,
        marginTop: 2,
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#EA580C',
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 16,
    },
    actionBtnText: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 13,
        color: '#FFFFFF',
    },
});
