import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Platform, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

import { API_URL } from '@/constants/api';
import { useSafeBack } from '@/hooks/useSafeBack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigationStack } from '@/contexts/NavigationStackContext';
import { useAndroidBackHandler } from '@/hooks/useAndroidBackHandler';
import { scale } from '@/utils/responsive';

const BENEFIT_CATEGORIES = [
    {
        id: 'included',
        label: 'Included',
        explanation: 'Part of your plan, up to the limits shown.',
        dotColor: '#10B981',
        badgeBg: '#ECFDF5',
        badgeBorder: '#A7F3D0',
        badgeText: '#065F46',
    },
    {
        id: 'addon',
        label: 'Member Rate / On-Demand',
        explanation: 'Available whenever you need it, at member-discounted rates for MaiHoonNa subscribers.',
        dotColor: '#3B82F6',
        badgeBg: '#EFF6FF',
        badgeBorder: '#BFDBFE',
        badgeText: '#1E40AF',
    },
    {
        id: 'arranged',
        label: 'We arrange it · Partner discount',
        explanation: 'We book and coordinate with trusted partners. You pay the partner directly, at a discounted member price.',
        dotColor: '#A855F7',
        badgeBg: '#FAF5FF',
        badgeBorder: '#E9D5FF',
        badgeText: '#6B21A8',
    },
];

function getCategoryForBenefit(pb: any): string {
    if (pb?.category) return pb.category;
    const name = (pb?.benefit?.name || pb?.name || (typeof pb === 'string' ? pb : '')).toLowerCase();
    const desc = (pb?.benefit?.description || pb?.description || '').toLowerCase();
    if (
        name.includes('facilitation') ||
        name.includes('coordination') ||
        name.includes('referral') ||
        name.includes('dentist home visit') ||
        name.includes('doctor at home') ||
        name.includes('ambulance support') ||
        name.includes('pharmacy assist') ||
        name.includes('travel made easy') ||
        desc.includes('facilitation') ||
        desc.includes('trusted partners')
    ) {
        return 'arranged';
    }
    if (
        name.includes('member rate') ||
        name.includes('on-demand')
    ) {
        return 'addon';
    }
    return 'included';
}

export default function PackageDetailScreen() {
    const router = useRouter();
    const { push, replace, pop } = useNavigationStack();
    useAndroidBackHandler();
    const safeBack = useSafeBack();
    const { type, cycle } = useLocalSearchParams<{ type: string; cycle?: string }>();
    const [pkg, setPkg] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [selectedCycle, setSelectedCycle] = useState<string>((cycle as string) || '3');

    useEffect(() => {
        const fetchPackage = async () => {
            try {
                const res = await fetch(`${API_URL}/subscriber/subscriptions/packages`);
                const data = await res.json();
                if (data.success) {
                    const found = data.data.find((p: any) => p.type === type);
                    setPkg(found);
                }
            } catch (e) {
                console.error('Package detail fetch error:', e);
            } finally {
                setLoading(false);
            }
        };
        fetchPackage();
    }, [type]);

    if (loading) {
        return (
            <SafeAreaView style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#F97316" />
            </SafeAreaView>
        );
    }

    if (!pkg) {
        return (
            <SafeAreaView style={styles.centerContainer}>
                <Text style={styles.errorText}>Package not found.</Text>
                <TouchableOpacity onPress={() => safeBack()} style={styles.backBtn}>
                    <Text style={styles.backBtnText}>Go Back</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    const isTrial = !!pkg.isFreeTrial;

    // ── Cycle-aware pricing helpers ─────────────────────────────────────────────
    const durNum = isTrial ? 1 : parseInt(selectedCycle, 10); // 1, 3, 6, or 12

    const calculatePrice = (p: any, cyc: string): number => {
        if (!p) return 0;
        if (isTrial) return p.basePrice || 0;
        const d = parseInt(cyc, 10);
        const base = p.basePrice || 0;
        if (d === 1)  return p.priceOneMonth     ?? base;
        if (d === 3)  return p.priceThreeMonths  ?? Math.round(base * 3  * (1 - (p.discountThreeMonths ?? 5)  / 100));
        if (d === 6)  return p.priceSixMonths    ?? Math.round(base * 6  * (1 - (p.discountSixMonths  ?? 10) / 100));
        if (d === 12) return p.priceTwelveMonths ?? Math.round(base * 12 * (1 - (p.discountAnnual    ?? 20) / 100));
        return base * d;
    };

    const totalPrice   = calculatePrice(pkg, selectedCycle);
    const fullPrice    = (pkg.basePrice || 0) * durNum;   // without discount
    const savedAmount  = isTrial ? 0 : Math.max(0, fullPrice - totalPrice);
    const discountPct  = (!isTrial && fullPrice > 0) ? Math.round((savedAmount / fullPrice) * 100) : 0;
    const monthlyRate  = isTrial ? (pkg.basePrice || 0) : (durNum > 0 ? Math.round(totalPrice / durNum) : totalPrice);
    const totalHours   = (pkg.totalHours || pkg.hoursPerMonth || 0) * (isTrial ? 1 : durNum);

    const cycleLabel = isTrial
        ? `${pkg.trialDurationDays ?? 30} Days Trial`
        : (selectedCycle === '12' ? '1 Year' : selectedCycle === '6' ? '6 Months' : selectedCycle === '1' ? '1 Month' : '3 Months');

    // Compute display units for a benefit based on its period and selected cycle
    const getBenefitUnits = (pb: any): string => {
        const base = pb.unitsIncluded ?? 0;
        const period = pb.unitsPeriod || 'monthly';
        let label = (pb.benefit?.unitLabel || 'visit').replace(/^per\s+/i, '').trim();
        if (pb.isUnlimited) return 'Unlimited';

        // Pluralize when base > 1 and doesn't already end with 's'
        if (base > 1 && !label.toLowerCase().endsWith('s')) {
            label = `${label}s`;
        }

        let periodText = "";
        if (period === "monthly") periodText = "/month";
        else if (period === "yearly") periodText = "/year";
        else if (period === "3_months") periodText = "/quarter";
        else if (period === "6_months") periodText = "/half-year";
        else if (period === "one_time") periodText = " (once)";

        return `${base} ${label}${periodText}`;
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: scale(130) }}>
                {/* Top Section with Gradient */}
                <LinearGradient colors={['#F97316', '#EA580C']} style={styles.heroSection}>
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => safeBack()} style={styles.headerBtn}>
                            <Ionicons name="arrow-back" size={scale(24)} color="#FFFFFF" />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>{pkg.name}</Text>
                        <View style={{ width: scale(40) }} />
                    </View>

                    <View style={styles.heroContent}>
                        {pkg.tagline ? <Text style={styles.heroTagline}>{pkg.tagline}</Text> : null}

                        {/* Cycle-aware total price */}
                        <View style={styles.priceRow}>
                            <Text style={styles.currency}>₹</Text>
                            <Text style={styles.price}>
                                {monthlyRate.toLocaleString()}
                                <Text style={{ fontSize: scale(24), fontWeight: '700', color: 'rgba(255,255,255,0.85)' }}>
                                    {isTrial ? ` / ${pkg.trialDurationDays ?? 30} days` : '/mo'}
                                </Text>
                            </Text>
                        </View>
                        <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: scale(15), fontWeight: '600', marginBottom: scale(6) }}>
                            ₹{totalPrice.toLocaleString()} total for {cycleLabel}
                        </Text>

                        {/* Savings row */}
                        {discountPct > 0 ? (
                            <View style={styles.savingsRow}>
                                <Text style={styles.mrp}>₹{fullPrice.toLocaleString()}</Text>
                                <View style={styles.discountBadge}>
                                    <Text style={styles.discountText}>SAVE {discountPct}%</Text>
                                </View>
                                {savedAmount > 0 && (
                                    <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: scale(12), marginLeft: scale(8) }}>
                                        (₹{savedAmount.toLocaleString()} off)
                                    </Text>
                                )}
                            </View>
                        ) : null}
                    </View>
                </LinearGradient>

                {/* ── Cycle Selector Toggle (Only for standard packages, hidden for trial packages) ── */}
                {!isTrial && (
                    <View style={styles.cycleToggle}>
                        {[
                            { key: '1',  label: '1 Month',  disc: '' },
                            { key: '3',  label: '3 Months', disc: '5% OFF' },
                            { key: '6',  label: '6 Months', disc: '10% OFF' },
                            { key: '12', label: '1 Year',   disc: '20% OFF' },
                        ].map((item) => {
                            const isActive = selectedCycle === item.key;
                            return (
                                <TouchableOpacity
                                    key={item.key}
                                    onPress={() => setSelectedCycle(item.key)}
                                    style={[styles.cycleBtn, isActive && styles.cycleBtnActive]}
                                    activeOpacity={0.8}
                                >
                                    <Text style={[styles.cycleBtnLabel, isActive && styles.cycleBtnLabelActive]}>
                                        {item.label}
                                    </Text>
                                    {item.disc ? (
                                        <Text style={[styles.cycleBtnBadge, isActive && styles.cycleBtnBadgeActive]}>
                                            {item.disc}
                                        </Text>
                                    ) : (
                                        <Text style={[styles.cycleBtnBadge, { opacity: 0 }]}>
                                            —
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}

                {/* Main Content */}
                <View style={styles.detailsContent}>

                    {/* Overview Card */}
                    <View style={styles.overviewCard}>
                        <View style={styles.overviewHeaderRow}>
                            <View style={styles.overviewIconWrap}>
                                <Ionicons name="sparkles" size={scale(15)} color="#F97316" />
                            </View>
                            <Text style={styles.overviewTitle}>Overview</Text>
                        </View>
                        <Text style={styles.overviewDescription}>
                            {pkg.description || 'Comprehensive care plan tailored for your family elders.'}
                        </Text>
                    </View>

                    {/* Features/Benefits Categorized into ONE unified container */}
                    {(() => {
                        const activeCategories = BENEFIT_CATEGORIES.map((catConfig) => {
                            const rawItems = (pkg.packageBenefits && pkg.packageBenefits.length > 0)
                                ? pkg.packageBenefits.filter((pb: any) => getCategoryForBenefit(pb) === catConfig.id)
                                : (pkg.features || []).filter((feat: string) => getCategoryForBenefit(feat) === catConfig.id);
                            return { ...catConfig, rawItems };
                        }).filter((c) => c.rawItems && c.rawItems.length > 0);

                        if (activeCategories.length === 0) return null;

                        return (
                            <View style={styles.benefitsContainerCard}>
                                {activeCategories.map((catConfig, catIdx) => {
                                    const isLastCategory = catIdx === activeCategories.length - 1;

                                    return (
                                        <View key={catConfig.id} style={styles.categorySection}>
                                            {/* Category Header Row */}
                                            <View style={styles.categoryHeader}>
                                                <View style={[styles.categoryDot, { backgroundColor: catConfig.dotColor }]} />
                                                <Text style={styles.categoryTitle}>{catConfig.label}</Text>
                                            </View>

                                            {/* Subtle explanation subtitle */}
                                            <Text style={styles.categoryExplanation}>{catConfig.explanation}</Text>

                                            {/* Benefits List */}
                                            <View style={styles.benefitList}>
                                                {pkg.packageBenefits && pkg.packageBenefits.length > 0 ? (
                                                    catConfig.rawItems.map((pb: any, i: number) => {
                                                        const unitsDisplay = getBenefitUnits(pb);
                                                        const rawName = pb.benefit?.name || '';
                                                        const isLastItem = i === catConfig.rawItems.length - 1;

                                                        return (
                                                            <View
                                                                key={pb.id || i}
                                                                style={styles.benefitItem}
                                                            >
                                                                {/* Black circle bullet */}
                                                                <View style={styles.bulletDot} />

                                                                {/* Text and Quota Pill */}
                                                                <View style={styles.benefitContent}>
                                                                    <View style={styles.benefitTopRow}>
                                                                        <Text style={styles.benefitName} numberOfLines={2}>
                                                                            {rawName}
                                                                        </Text>
                                                                        {pb.showUnit !== false && unitsDisplay ? (
                                                                            <View
                                                                                style={[
                                                                                    styles.quotaBadge,
                                                                                    {
                                                                                        backgroundColor: catConfig.badgeBg,
                                                                                        borderColor: catConfig.badgeBorder,
                                                                                    }
                                                                                ]}
                                                                            >
                                                                                <Text style={[styles.quotaBadgeText, { color: catConfig.badgeText }]}>
                                                                                    {unitsDisplay}
                                                                                </Text>
                                                                            </View>
                                                                        ) : null}
                                                                    </View>

                                                                    {pb.benefit?.description ? (
                                                                        <Text style={styles.benefitDescription}>
                                                                            {pb.benefit.description}
                                                                        </Text>
                                                                    ) : null}
                                                                </View>
                                                            </View>
                                                        );
                                                    })
                                                ) : (
                                                    catConfig.rawItems.map((feature: string, i: number) => (
                                                        <View key={i} style={styles.benefitItem}>
                                                            <View style={styles.bulletDot} />
                                                            <Text style={styles.benefitName}>{feature}</Text>
                                                        </View>
                                                    ))
                                                )}
                                            </View>

                                            {/* Divider between categories inside the single box */}
                                            {!isLastCategory && <View style={styles.categorySectionDivider} />}
                                        </View>
                                    );
                                })}
                            </View>
                        );
                    })()}

                    {/* Disclaimer Box */}
                    <View style={styles.disclaimerBox}>
                        <Ionicons name="information-circle" size={scale(18)} color="#D97706" style={{ marginTop: scale(1) }} />
                        <Text style={styles.disclaimerText}>
                            Actual visits and hours might vary based on Care Companion availability and your specific location in the city.
                        </Text>
                    </View>
                </View>
            </ScrollView>

            {/* Sticky Action Footer */}
            <View style={styles.footer}>
                <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={async () => {
                        const token = await AsyncStorage.getItem('userToken');
                        if (!token) {
                            push({ pathname: '/(auth)/register' });
                        } else {
                            push('/(setup)/checkout', { packageId: pkg.type, durationMonths: isTrial ? 1 : selectedCycle });
                        }
                    }}
                >
                    <Text style={styles.actionBtnText}>Select this Package</Text>
                    <Ionicons name="arrow-forward" size={scale(20)} color="#FFFFFF" style={{ marginLeft: scale(8) }} />
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: scale(20), paddingTop: scale(10), paddingBottom: scale(20)
    },
    headerBtn: { width: scale(40), height: scale(40), borderRadius: scale(20), backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontSize: scale(18), fontWeight: '700', color: '#FFFFFF' },

    heroSection: { paddingTop: 0, paddingBottom: scale(36), borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
    heroContent: { alignItems: 'center', paddingHorizontal: scale(30), paddingTop: scale(10) },
    heroTagline: { fontSize: scale(18), fontWeight: '700', color: '#FFFFFF', textAlign: 'center', marginBottom: scale(16) },

    priceRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: scale(4) },
    currency: { fontSize: scale(24), color: '#FFFFFF', fontWeight: '800', marginRight: scale(4) },
    price: { fontSize: scale(42), color: '#FFFFFF', fontWeight: '900' },
    period: { fontSize: scale(16), color: 'rgba(255,255,255,0.8)', marginLeft: scale(6) },

    savingsRow: { flexDirection: 'row', alignItems: 'center', marginTop: scale(6) },
    mrp: { fontSize: scale(16), color: 'rgba(255,255,255,0.6)', textDecorationLine: 'line-through', marginRight: scale(10) },
    discountBadge: { backgroundColor: '#FFD6BA', paddingHorizontal: scale(8), paddingVertical: scale(4), borderRadius: scale(6) },
    discountText: { color: '#EA580C', fontSize: scale(11), fontWeight: '800' },

    // Cycle toggle on details page
    cycleToggle: {
        flexDirection: 'row',
        backgroundColor: '#EDF2F7',
        borderRadius: scale(16),
        padding: scale(4),
        marginHorizontal: scale(20),
        marginTop: scale(16),
        marginBottom: scale(4),
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    cycleBtn: {
        flex: 1,
        paddingVertical: scale(8),
        borderRadius: scale(12),
        alignItems: 'center',
        justifyContent: 'center',
    },
    cycleBtnActive: {
        backgroundColor: '#FE6700',
        shadowColor: '#FE6700',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 3,
    },
    cycleBtnLabel: {
        fontSize: scale(12),
        fontWeight: '700',
        color: '#334155',
    },
    cycleBtnLabelActive: {
        color: '#FFFFFF',
    },
    cycleBtnBadge: {
        fontSize: scale(9),
        fontWeight: '700',
        color: '#EA580C',
        marginTop: scale(2),
    },
    cycleBtnBadgeActive: {
        color: 'rgba(255,255,255,0.92)',
    },

    detailsContent: {
        paddingHorizontal: scale(20),
        paddingTop: scale(20),
    },

    // Overview Card
    overviewCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: scale(18),
        padding: scale(16),
        marginBottom: scale(16),
        borderWidth: 1,
        borderColor: '#F1F5F9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    overviewHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(8),
        marginBottom: scale(8),
    },
    overviewIconWrap: {
        width: scale(28),
        height: scale(28),
        borderRadius: scale(14),
        backgroundColor: '#FFF7ED',
        justifyContent: 'center',
        alignItems: 'center',
    },
    overviewTitle: {
        fontSize: scale(16),
        fontWeight: '800',
        color: '#111827',
    },
    overviewDescription: {
        fontSize: scale(14),
        color: '#4B5563',
        lineHeight: scale(22),
    },

    // Unified Benefits Container Card
    benefitsContainerCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: scale(18),
        padding: scale(16),
        marginBottom: scale(16),
        borderWidth: 1,
        borderColor: '#F1F5F9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    categorySection: {
        width: '100%',
    },
    categoryHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    categoryDot: {
        width: scale(9),
        height: scale(9),
        borderRadius: scale(4.5),
        marginRight: scale(8),
    },
    categoryTitle: {
        fontSize: scale(16),
        fontWeight: '800',
        color: '#111827',
    },
    categoryExplanation: {
        fontSize: scale(12),
        color: '#64748B',
        marginTop: scale(4),
        marginBottom: scale(8),
        lineHeight: scale(17),
    },
    categorySectionDivider: {
        height: 1,
        backgroundColor: '#E2E8F0',
        marginTop: scale(18),
        marginBottom: scale(16),
    },

    // Benefit Items List
    benefitList: {
        gap: 0,
    },
    benefitItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingVertical: scale(9),
    },
    bulletDot: {
        width: scale(6),
        height: scale(6),
        borderRadius: scale(3),
        backgroundColor: '#111827',
        marginRight: scale(10),
        marginTop: scale(7),
    },
    benefitContent: {
        flex: 1,
    },
    benefitTopRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: scale(8),
    },
    benefitName: {
        fontSize: scale(14),
        fontWeight: '700',
        color: '#1E293B',
        lineHeight: scale(20),
        flex: 1,
    },
    quotaBadge: {
        paddingHorizontal: scale(8),
        paddingVertical: scale(2),
        borderRadius: scale(6),
        borderWidth: 1,
        alignSelf: 'flex-start',
    },
    quotaBadgeText: {
        fontSize: scale(11),
        fontWeight: '700',
    },
    benefitDescription: {
        fontSize: scale(13),
        color: '#64748B',
        marginTop: scale(4),
        lineHeight: scale(18),
    },

    // Disclaimer Box
    disclaimerBox: {
        flexDirection: 'row',
        padding: scale(14),
        backgroundColor: '#FFFBEB',
        borderRadius: scale(14),
        borderWidth: 1,
        borderColor: '#FDE68A',
        marginBottom: scale(20),
        alignItems: 'flex-start',
    },
    disclaimerText: {
        flex: 1,
        fontSize: scale(12),
        color: '#92400E',
        marginLeft: scale(10),
        lineHeight: scale(18),
    },

    // Sticky Action Footer
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#FFFFFF',
        padding: scale(20),
        borderTopWidth: 1,
        borderTopColor: '#E2E8F0',
        paddingBottom: Platform.OS === 'ios' ? 36 : 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 8,
    },
    actionBtn: {
        backgroundColor: '#F97316',
        height: scale(54),
        borderRadius: scale(16),
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#F97316',
        shadowOffset: { width: 0, height: scale(4) },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 5,
    },
    actionBtnText: { color: '#FFFFFF', fontSize: scale(16), fontWeight: '800' },
    errorText: { fontSize: scale(16), color: '#6B7280', marginBottom: scale(20) },
    backBtn: { backgroundColor: '#F97316', paddingHorizontal: scale(24), paddingVertical: scale(12), borderRadius: scale(12) },
    backBtnText: { color: '#FFFFFF', fontWeight: '700' }
});
