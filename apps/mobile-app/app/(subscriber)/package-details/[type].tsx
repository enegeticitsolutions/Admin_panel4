import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Platform, Image, Alert } from 'react-native';
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
        label: 'Add-on · Member rate',
        explanation: 'Available whenever you need it, at a lower rate for MaiHoonNa members.',
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
        name.includes('add-on') ||
        name.includes('addon') ||
        name.includes('member rate') ||
        name.includes('on-demand') ||
        pb?.benefit?.isAddon
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
        const label = (pb.benefit?.unitLabel || 'visit').replace(/^per\s+/i, '');
        if (pb.isUnlimited) return 'Unlimited';
        
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
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: scale(100) }}>
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
                        <View style={styles.badgeWrapper}>
                            <View style={styles.typeBadge}>
                                <Text style={styles.typeBadgeText}>{pkg.name}</Text>
                            </View>
                        </View>
                        <Text style={styles.heroTagline}>{pkg.tagline}</Text>

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
                                >
                                    <Text style={[styles.cycleBtnLabel, isActive && styles.cycleBtnLabelActive]}>{item.label}</Text>
                                    <Text style={[styles.cycleBtnBadge, isActive && styles.cycleBtnBadgeActive]}>{item.disc || ' '}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}

                {/* Main Content */}
                <View style={styles.detailsContent}>

                    {/* Description */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Overview</Text>
                        <Text style={styles.descriptionText}>{pkg.description}</Text>
                    </View>

                    {/* Features/Benefits Categorized into Included, Add-on, and We arrange it */}
                    {BENEFIT_CATEGORIES.map((catConfig) => {
                        const rawItems = (pkg.packageBenefits && pkg.packageBenefits.length > 0)
                            ? pkg.packageBenefits.filter((pb: any) => getCategoryForBenefit(pb) === catConfig.id)
                            : (pkg.features || []).filter((feat: string) => getCategoryForBenefit(feat) === catConfig.id);

                        if (!rawItems || rawItems.length === 0) return null;

                        return (
                            <View key={catConfig.id} style={[styles.section, { marginBottom: scale(16) }]}>
                                {/* Category Header Row with (i) Info Button */}
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: scale(4) }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(8) }}>
                                        <View style={{ width: scale(8), height: scale(8), borderRadius: scale(4), backgroundColor: catConfig.dotColor }} />
                                        <Text style={styles.sectionTitle}>{catConfig.label}</Text>
                                        <TouchableOpacity
                                            onPress={() => Alert.alert(catConfig.label, catConfig.explanation)}
                                            style={{ padding: scale(4) }}
                                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                        >
                                            <Ionicons name="information-circle-outline" size={scale(18)} color="#9CA3AF" />
                                        </TouchableOpacity>
                                    </View>
                                    <View
                                        style={{
                                            paddingHorizontal: scale(8),
                                            paddingVertical: scale(2),
                                            borderRadius: scale(999),
                                            backgroundColor: catConfig.badgeBg,
                                            borderWidth: 1,
                                            borderColor: catConfig.badgeBorder,
                                        }}
                                    >
                                        <Text style={{ fontSize: scale(10), fontWeight: '700', color: catConfig.badgeText }}>
                                            {rawItems.length} {rawItems.length === 1 ? 'item' : 'items'}
                                        </Text>
                                    </View>
                                </View>

                                <View style={styles.benefitList}>
                                    {pkg.packageBenefits && pkg.packageBenefits.length > 0 ? (
                                        rawItems.map((pb: any, i: number) => {
                                            const unitsDisplay = getBenefitUnits(pb);
                                            return (
                                                <View key={i} style={styles.benefitItem}>
                                                    <View style={styles.checkIcon}>
                                                        <Ionicons name="checkmark" size={scale(16)} color="#059669" />
                                                    </View>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={styles.benefitText}>
                                                            {pb.showUnit !== false ? (
                                                                <><Text style={{ fontWeight: '700' }}>{unitsDisplay}</Text>{' '}• </>
                                                            ) : null}
                                                            {pb.benefit?.name}
                                                        </Text>
                                                        {pb.benefit?.description ? (
                                                            <Text style={{ fontSize: scale(13), color: '#6B7280', marginTop: scale(4) }}>
                                                                {pb.benefit.description}
                                                            </Text>
                                                        ) : null}
                                                    </View>
                                                </View>
                                            );
                                        })
                                    ) : (
                                        rawItems.map((feature: string, i: number) => (
                                            <View key={i} style={styles.benefitItem}>
                                                <View style={styles.checkIcon}>
                                                    <Ionicons name="checkmark" size={scale(16)} color="#059669" />
                                                </View>
                                                <Text style={styles.benefitText}>{feature}</Text>
                                            </View>
                                        ))
                                    )}
                                </View>
                            </View>
                        );
                    })}

                    {/* Disclaimer */}
                    <View style={styles.disclaimerBox}>
                        <Ionicons name="information-circle-outline" size={scale(20)} color="#6B7280" />
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
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: scale(20), paddingTop: scale(10), paddingBottom: scale(20)
    },
    headerBtn: { width: scale(40), height: scale(40), borderRadius: scale(20), backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontSize: scale(18), fontWeight: '700', color: '#FFFFFF' },

    heroSection: { paddingTop: 0, paddingBottom: scale(40), borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
    heroContent: { alignItems: 'center', paddingHorizontal: scale(30) },
    badgeWrapper: { marginBottom: scale(12) },
    typeBadge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: scale(16), paddingVertical: scale(6), borderRadius: scale(12) },
    typeBadgeText: { color: '#FFFFFF', fontSize: scale(13), fontWeight: '800', textTransform: 'uppercase' },
    heroTagline: { fontSize: scale(24), fontWeight: '800', color: '#FFFFFF', textAlign: 'center', marginBottom: scale(20) },

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
        flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 14,
        padding: 4, marginHorizontal: scale(24), marginTop: scale(20), marginBottom: scale(4),
        borderWidth: 1, borderColor: '#E2E8F0',
    },
    cycleBtn: { flex: 1, paddingVertical: scale(10), borderRadius: 10, alignItems: 'center' },
    cycleBtnActive: { backgroundColor: '#FE6700' },
    cycleBtnLabel: { fontSize: scale(11), fontWeight: '800', color: '#1E293B' },
    cycleBtnLabelActive: { color: '#FFFFFF' },
    cycleBtnBadge: { fontSize: scale(9), color: '#64748B', marginTop: scale(2) },
    cycleBtnBadgeActive: { color: 'rgba(255,255,255,0.85)' },

    detailsContent: { paddingHorizontal: scale(24), paddingTop: scale(30) },
    quickStats: {
        flexDirection: 'row', backgroundColor: '#F9FAFB', borderRadius: scale(24), padding: scale(20),
        marginBottom: scale(32), borderWidth: 1, borderColor: '#F3F4F6'
    },
    statItem: { flex: 1, alignItems: 'center' },
    statValue: { fontSize: scale(18), fontWeight: '800', color: '#111827', marginTop: scale(4) },
    statLabel: { fontSize: scale(11), color: '#9CA3AF', marginTop: scale(2), textAlign: 'center' },
    statDivider: { width: 1, height: '60%', backgroundColor: '#E5E7EB', alignSelf: 'center' },

    section: { marginBottom: scale(32) },
    sectionTitle: { fontSize: scale(18), fontWeight: '800', color: '#111827', marginBottom: scale(16) },
    descriptionText: { fontSize: scale(15), color: '#4B5563', lineHeight: scale(24) },

    benefitList: { gap: scale(16) },
    benefitItem: { flexDirection: 'row', alignItems: 'flex-start' },
    checkIcon: {
        width: scale(24), height: scale(24), borderRadius: scale(12), backgroundColor: '#ECFDF5',
        justifyContent: 'center', alignItems: 'center', marginRight: scale(12), marginTop: scale(2)
    },
    benefitText: { fontSize: scale(15), color: '#374151', flex: 1, lineHeight: scale(22) },

    disclaimerBox: {
        flexDirection: 'row', padding: scale(16), backgroundColor: '#F9FAFB',
        borderRadius: scale(16), marginBottom: scale(20), alignItems: 'center'
    },
    disclaimerText: { flex: 1, fontSize: scale(12), color: '#6B7280', marginLeft: scale(12), lineHeight: scale(18) },

    footer: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: '#FFFFFF', padding: scale(20), borderTopWidth: 1, borderTopColor: '#F3F4F6',
        paddingBottom: Platform.OS === 'ios' ? 40 : 20
    },
    actionBtn: {
        backgroundColor: '#F97316', height: scale(56), borderRadius: scale(16),
        flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
        shadowColor: '#F97316', shadowOffset: { width: 0, height: scale(4) }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5
    },
    actionBtnText: { color: '#FFFFFF', fontSize: scale(16), fontWeight: '800' },
    errorText: { fontSize: scale(16), color: '#6B7280', marginBottom: scale(20) },
    backBtn: { backgroundColor: '#F97316', paddingHorizontal: scale(24), paddingVertical: scale(12), borderRadius: scale(12) },
    backBtnText: { color: '#FFFFFF', fontWeight: '700' }
});
