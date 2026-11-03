import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';

interface QuickActionsSectionProps {
    actionCardWidth: number;
    sathiEligible?: boolean;
    hasFamilyOrPlans?: boolean;
    onFamilyConnectPress?: () => void;
    onLogVitalsPress?: () => void;
    onSaathiPress?: () => void;
    onActionPress: (route: string) => void;
}

export const QuickActionsSection: React.FC<QuickActionsSectionProps> = ({
    actionCardWidth,
    sathiEligible = false,
    hasFamilyOrPlans = false,
    onFamilyConnectPress,
    onLogVitalsPress,
    onSaathiPress,
    onActionPress,
}) => {
    return (
        <View style={styles.container}>
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Quick Actions</Text>
            </View>

            <View style={styles.grid}>
                <TouchableOpacity
                    style={[styles.card, { width: actionCardWidth }]}
                    onPress={() => {
                        if (onFamilyConnectPress) {
                            onFamilyConnectPress();
                        } else {
                            onActionPress('/(subscriber)');
                        }
                    }}
                    activeOpacity={0.8}
                >
                    <View style={[styles.iconBadge, { backgroundColor: '#EFF6FF' }]}>
                        <Ionicons name="people" size={24} color="#2563EB" />
                    </View>
                    <Text style={styles.cardTitle} numberOfLines={1} adjustsFontSizeToFit>Family Connect</Text>
                    <Text style={styles.cardSubtitle} numberOfLines={2}>
                        {hasFamilyOrPlans ? 'Reports & family status' : 'Learn & connect family'}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.card, { width: actionCardWidth }]}
                    onPress={() => onActionPress('/(setup)/subscription-packages')}
                    activeOpacity={0.8}
                >
                    <View style={[styles.iconBadge, { backgroundColor: '#FFF5ED' }]}>
                        <Feather name="shopping-bag" size={24} color="#FE6700" />
                    </View>
                    <Text style={styles.cardTitle} numberOfLines={1} adjustsFontSizeToFit>Browse Packages</Text>
                    <Text style={styles.cardSubtitle} numberOfLines={2}>Care plans & add members</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.card, { width: actionCardWidth }]}
                    onPress={() => {
                        if (onLogVitalsPress) {
                            onLogVitalsPress();
                        } else {
                            onActionPress('/(beneficiary)/vitals');
                        }
                    }}
                    activeOpacity={0.8}
                >
                    <View style={[styles.iconBadge, { backgroundColor: '#FEE2E2' }]}>
                        <Feather name="heart" size={24} color="#EF4444" />
                    </View>
                    <Text style={styles.cardTitle} numberOfLines={1} adjustsFontSizeToFit>Log Vitals</Text>
                    <Text style={styles.cardSubtitle} numberOfLines={2}>Track blood pressure & more</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.card, { width: actionCardWidth }]}
                    onPress={() => onActionPress('/(beneficiary)/meds')}
                    activeOpacity={0.8}
                >
                    <View style={[styles.iconBadge, { backgroundColor: '#FEF3C7' }]}>
                        <MaterialCommunityIcons name="pill" size={24} color="#D97706" />
                    </View>
                    <Text style={styles.cardTitle} numberOfLines={1} adjustsFontSizeToFit>Medications</Text>
                    <Text style={styles.cardSubtitle} numberOfLines={2}>View schedule & details</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.card, { width: actionCardWidth }]}
                    onPress={() => {
                        if (onSaathiPress) {
                            onSaathiPress();
                        } else {
                            onActionPress('/(beneficiary)/sathi-request');
                        }
                    }}
                    activeOpacity={0.8}
                >
                    <View style={[styles.iconBadge, { backgroundColor: '#FFF7ED' }]}>
                        <Feather name="users" size={24} color="#FF6A00" />
                    </View>
                    <Text style={styles.cardTitle} numberOfLines={1} adjustsFontSizeToFit>Saathi Companion</Text>
                    <Text style={styles.cardSubtitle} numberOfLines={2}>
                        {sathiEligible ? 'Request visit & help' : 'Learn & explore service'}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.card, { width: actionCardWidth }]}
                    onPress={() => onActionPress('/package-utilization')}
                    activeOpacity={0.8}
                >
                    <View style={[styles.iconBadge, { backgroundColor: '#FFF3EB' }]}>
                        <Feather name="package" size={24} color="#F97316" />
                    </View>
                    <Text style={styles.cardTitle} numberOfLines={1} adjustsFontSizeToFit>Package Utilization</Text>
                    <Text style={styles.cardSubtitle} numberOfLines={2}>Track your benefits</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 20,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
        marginTop: 8,
    },
    sectionTitle: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 18,
        lineHeight: 24,
        color: '#0F172A',
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        rowGap: 16,
    },
    card: {
        height: 132,
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        padding: 16,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    iconBadge: {
        width: 44,
        height: 44,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardTitle: {
        marginTop: 8,
        fontFamily: 'Poppins-Medium',
        fontSize: 13,
        color: '#000000',
    },
    cardSubtitle: {
        fontFamily: 'Poppins-Regular',
        fontSize: 11,
        color: '#4B5563',
        marginTop: 2,
    },
});
