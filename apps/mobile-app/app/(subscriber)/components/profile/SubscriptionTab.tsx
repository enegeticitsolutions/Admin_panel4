import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { formatHours } from '@/utils/timeFormat';
import { useNavigationStack } from '@/contexts/NavigationStackContext';
import { useAndroidBackHandler } from '@/hooks/useAndroidBackHandler';
import { sanitizeImageUri } from '@/utils/sanitizeImageUri';
import { scale } from '@/utils/responsive';

interface SubscriptionTabProps {
    plan: {
        name: string;
        hoursTotal: number;
        hoursUsed: number;
        nextBillingDate: string;
        isActive: boolean;
    } | null;
    beneficiaries: any[];
}

const SubscriptionTab = ({ plan, beneficiaries }: SubscriptionTabProps) => {
    const router = useRouter();
    const { push, replace, pop } = useNavigationStack();
    useAndroidBackHandler();
    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });
    };

    const progress = (plan && plan.hoursTotal > 0) ? (plan.hoursUsed / plan.hoursTotal) : 0;

    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            {/* Current Plan Card */}
            {plan ? (
                <TouchableOpacity 
                    onPress={() => {
                        if (beneficiaries && beneficiaries.length === 1) {
                            push({ pathname: '/package-utilization', params: { beneficiaryId: beneficiaries[0].id } });
                        } else {
                            push('/package-utilization');
                        }
                    }} 
                    activeOpacity={0.9}
                >
                    <LinearGradient colors={['#F97316', '#EA580C']} style={styles.planCard}>
                        <View style={styles.planHeader}>
                            <View style={styles.planTitleContainer}>
                                <Text style={styles.planLabel}>Current Plan</Text>
                                <Text style={styles.planName} numberOfLines={2}>{plan.name}</Text>
                            </View>
                            <View style={styles.activeBadge}>
                                <View style={styles.activeDot} />
                                <Text style={styles.activeText}>Active</Text>
                            </View>
                        </View>

                        <View style={styles.progressSection}>
                            <View style={styles.progressLabels}>
                                <Text style={styles.progressText}>Hours Used</Text>
                                <Text style={styles.progressText}>{formatHours(plan.hoursUsed)} / {formatHours(plan.hoursTotal)}</Text>
                            </View>
                            <View style={styles.progressBarBg}>
                                <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
                            </View>
                        </View>

                        <View style={styles.planFooter}>
                            <Text style={styles.footerLabel}>Next Billing Date</Text>
                            <Text style={styles.footerValue}>{formatDate(plan.nextBillingDate)}</Text>
                        </View>
                    </LinearGradient>
                </TouchableOpacity>
            ) : (
                <View style={[styles.planEmptyCard]}>
                    <Ionicons name="ribbon-outline" size={scale(40)} color="#D1D5DB" />
                    <Text style={styles.emptyText}>No Active Subscription</Text>
                </View>
            )}

            {/* Manage Subscription */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Manage Subscription</Text>
                <View style={styles.card}>
                    {[
                        { icon: 'ribbon-outline', title: 'Upgrade Plan', sub: 'Get more hours & benefits', onPress: () => push('/(setup)/subscription-packages') },
                        { icon: 'document-text-outline', title: 'Billing History', sub: 'View past invoices', onPress: () => push('/(subscriber)/order-history') },
                    ].map((item, i, arr) => (
                        <React.Fragment key={i}>
                            <TouchableOpacity style={styles.manageItem} onPress={item.onPress}>
                                <View style={[styles.iconBox, manageToneByTitle[item.title]?.box]}>
                                    <Ionicons name={item.icon as any} size={scale(23)} color={manageToneByTitle[item.title]?.color || '#FF5B0A'} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.manageTitle}>{item.title}</Text>
                                    <Text style={styles.manageSub}>{item.sub}</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={scale(18)} color="#D1D5DB" />
                            </TouchableOpacity>
                            {i < arr.length - 1 && <View style={styles.divider} />}
                        </React.Fragment>
                    ))}
                </View>
            </View>

            {/* Your Beneficiaries */}
            <View style={styles.section}>
                <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionTitle}>Your Beneficiaries</Text>
                    <TouchableOpacity
                        style={styles.addBtn}
                        activeOpacity={0.7}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        onPress={() => push('/(setup)/beneficiary-info')}
                    >
                        <Text style={styles.addBtnText}>+ Add</Text>
                    </TouchableOpacity>
                </View>

                {beneficiaries?.length > 0 ? (
                    beneficiaries.map((b, i) => (
                        <TouchableOpacity
                            key={b.id || i}
                            style={styles.benCard}
                            onPress={() => push({ pathname: '/(subscriber)/beneficiary-profile', params: { id: b.id } })}
                        >
                            <View style={[styles.benAvatar]}>
                                {b.photo ? (
                                    <Image source={{ uri: b.photo }} style={styles.benPhoto} />
                                ) : (
                                    <View style={styles.initialsBox}>
                                        <Text style={styles.benInitials}>{b.name[0]}</Text>
                                    </View>
                                )}
                            </View>
                            <View style={{ flex: 1, marginLeft: scale(14) }}>
                                <Text style={styles.benName}>{b.name}</Text>
                                <Text style={styles.benMeta}>{b.relationship} • {b.age} years</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={scale(18)} color="#D1D5DB" />
                        </TouchableOpacity>
                    ))
                ) : (
                    <Text style={styles.emptySubText}>No beneficiaries added yet.</Text>
                )}
            </View>
        </ScrollView>
    );
};

const manageToneByTitle: Record<string, { color: string; box: object }> = {
    'Upgrade Plan': { color: '#FF5B0A', box: { backgroundColor: '#FFEBCB' } },
    'Payment Methods': { color: '#1F6BFF', box: { backgroundColor: '#DDEBFF' } },
    'Billing History': { color: '#A12BFF', box: { backgroundColor: '#F2DFFF' } },
};

const styles = StyleSheet.create({
    container: { paddingHorizontal: scale(15), paddingTop: scale(2) },
    planCard: {
        borderRadius: scale(16),
        paddingHorizontal: scale(20),
        paddingTop: scale(20),
        paddingBottom: scale(20),
        marginBottom: scale(12),
        ...Platform.select({
            ios: { shadowColor: '#FF5B0A', shadowOffset: { width: 0, height: scale(6) }, shadowOpacity: 0.22, shadowRadius: 10 },
            android: { elevation: 6 }
        })
    },
    planEmptyCard: { 
        backgroundColor: '#FFFFFF', borderRadius: scale(24), padding: scale(30), marginBottom: scale(24),
        alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#F3F4F6', borderStyle: 'dashed'
    },
    emptyText: { color: '#9CA3AF', fontWeight: '600', marginTop: scale(10) },
    emptySubText: { color: '#9CA3AF', fontSize: scale(13), textAlign: 'center', marginTop: scale(10) },

    planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: scale(18) },
    planTitleContainer: { flex: 1, marginRight: scale(10) },
    planLabel: { fontSize: scale(13), color: 'rgba(255, 255, 255, 0.85)', marginBottom: scale(4), fontWeight: '500' },
    planName: { fontSize: scale(20), fontWeight: '800', color: '#FFFFFF', lineHeight: scale(25) },
    activeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: scale(10),
        paddingVertical: scale(5),
        borderRadius: scale(14),
        flexShrink: 0,
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3 },
            android: { elevation: 2 },
        }),
    },
    activeDot: {
        width: scale(6),
        height: scale(6),
        borderRadius: scale(3),
        backgroundColor: '#16A34A',
        marginRight: scale(5),
    },
    activeText: { color: '#16A34A', fontSize: scale(12), fontWeight: '700' },
    
    progressSection: { marginBottom: scale(16) },
    progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: scale(10) },
    progressText: { fontSize: scale(14), color: '#FFFFFF', fontWeight: '600' },
    progressBarBg: { height: scale(8), backgroundColor: 'rgba(0,0,0,0.18)', borderRadius: scale(4), overflow: 'hidden' },
    progressBarFill: { height: scale(8), backgroundColor: '#FFFFFF', borderRadius: scale(4) },

    planFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: scale(14), borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.25)' },
    footerLabel: { fontSize: scale(13), color: 'rgba(255,255,255,0.85)', fontWeight: '500' },
    footerValue: { fontSize: scale(14), color: '#FFFFFF', fontWeight: '700' },

    section: {
        backgroundColor: '#FFFFFF',
        borderRadius: scale(15),
        paddingHorizontal: scale(16),
        paddingTop: scale(18),
        paddingBottom: scale(16),
        marginBottom: scale(12),
        borderWidth: 1,
        borderColor: '#F2E7DE',
        ...Platform.select({
            ios: { shadowColor: '#4A2B17', shadowOffset: { width: 0, height: scale(4) }, shadowOpacity: 0.12, shadowRadius: 8 },
            android: { elevation: 3 },
        }),
    },
    sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: scale(15) },
    sectionTitle: { fontSize: scale(20), fontWeight: '600', color: '#111111' },
    addBtn: { backgroundColor: '#FFFFFF', paddingHorizontal: scale(3), paddingVertical: scale(4), borderRadius: scale(8) },
    addBtnText: { color: '#FF5B0A', fontWeight: '500', fontSize: scale(14) },

    card: { backgroundColor: 'transparent', borderRadius: 0, padding: 0 },
    manageItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: scale(12) },
    iconBox: { width: scale(47), height: scale(47), borderRadius: scale(24), justifyContent: 'center', alignItems: 'center', marginRight: scale(14) },
    manageTitle: { fontSize: scale(17), fontWeight: '600', color: '#111111' },
    manageSub: { fontSize: scale(15), color: '#4B5563', marginTop: scale(4) },
    divider: { height: scale(10), backgroundColor: 'transparent', marginLeft: scale(61) },

    benCard: { backgroundColor: '#F8F8F8', borderRadius: scale(12), padding: scale(12), marginBottom: scale(9), flexDirection: 'row', alignItems: 'center' },
    benAvatar: { width: scale(40), height: scale(40), borderRadius: scale(20), overflow: 'hidden' },
    initialsBox: { width: scale(40), height: scale(40), backgroundColor: '#FF5B0A', justifyContent: 'center', alignItems: 'center' },
    benPhoto: { width: scale(40), height: scale(40) },
    benInitials: { fontSize: scale(13), fontWeight: '700', color: '#FFFFFF' },
    benName: { fontSize: scale(16), fontWeight: '700', color: '#111111', marginBottom: scale(2) },
    benMeta: { fontSize: scale(14), color: '#4B5563' },
});

export default SubscriptionTab;
