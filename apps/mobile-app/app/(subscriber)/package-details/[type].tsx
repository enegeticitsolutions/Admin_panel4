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

    // ── Cycle-aware pricing helpers ─────────────────────────────────────────────
    const durNum = parseInt(selectedCycle, 10); // 3, 6, or 12

    const calculatePrice = (p: any, cyc: string): number => {
        if (!p) return 0;
        const d = parseInt(cyc, 10);
        const base = p.basePrice || 0;
        if (d === 3)  return p.priceThreeMonths  ?? Math.round(base * 3  * (1 - (p.discountThreeMonths ?? 5)  / 100));
        if (d === 6)  return p.priceSixMonths    ?? Math.round(base * 6  * (1 - (p.discountSixMonths  ?? 10) / 100));
        if (d === 12) return p.priceTwelveMonths ?? Math.round(base * 12 * (1 - (p.discountAnnual    ?? 20) / 100));
        return base * d;
    };

    const totalPrice   = calculatePrice(pkg, selectedCycle);
    const fullPrice    = (pkg.basePrice || 0) * durNum;   // without discount
    const savedAmount  = Math.max(0, fullPrice - totalPrice);
    const discountPct  = fullPrice > 0 ? Math.round((savedAmount / fullPrice) * 100) : 0;
    const monthlyRate  = durNum > 0 ? Math.round(totalPrice / durNum) : totalPrice;
    const totalHours   = (pkg.totalHours || pkg.hoursPerMonth || 0) * durNum;

    const cycleLabel = selectedCycle === '12' ? '1 Year' : selectedCycle === '6' ? '6 Months' : '3 Months';

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
            {/* Transparent Header Over Gradient */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => safeBack()} style={styles.headerBtn}>
                    <Ionicons name="arrow-back" size={scale(24)} color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Plan Details</Text>
                <View style={{ width: scale(40) }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: scale(100) }}>
                {/* Top Section with Gradient */}
                <LinearGradient colors={['#F97316', '#EA580C']} style={styles.heroSection}>
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
                            <Text style={styles.price}>{totalPrice.toLocaleString()}</Text>
                        </View>
                        <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: scale(13), marginBottom: scale(6) }}>
                            ₹{monthlyRate.toLocaleString()}/mo · {cycleLabel}
                        </Text>

                        {/* Savings row */}
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
                    </View>
                </LinearGradient>

                {/* ── Cycle Selector Toggle ── */}
                <View style={styles.cycleToggle}>
                    {[
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
                                <Text style={[styles.cycleBtnBadge, isActive && styles.cycleBtnBadgeActive]}>{item.disc}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Main Content */}
                <View style={styles.detailsContent}>
                    {/* Key Stats — show totals for the selected period */}
                    <View style={styles.quickStats}>
                        <View style={styles.statItem}>
                            <Ionicons name="time-outline" size={scale(24)} color="#F97316" />
                            <Text style={styles.statValue}>{totalHours}h</Text>
                            <Text style={styles.statLabel}>Total Care Hours</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Ionicons name="calendar-outline" size={scale(24)} color="#F97316" />
                            <Text style={styles.statValue}>{pkg.visitsPerWeek || 0}</Text>
                            <Text style={styles.statLabel}>Visits / week</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Ionicons name="people-outline" size={scale(24)} color="#F97316" />
                            <Text style={styles.statValue}>{pkg.maxBeneficiaries || 1}</Text>
                            <Text style={styles.statLabel}>Beneficiaries</Text>
                        </View>
                    </View>

                    {/* Description */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Overview</Text>
                        <Text style={styles.descriptionText}>{pkg.description}</Text>
                    </View>

                    {/* Features/Benefits — quantities scaled to selected cycle */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Plan Inclusions</Text>
                        <Text style={{ fontSize: scale(12), color: '#9CA3AF', marginBottom: scale(12), marginTop: scale(-8) }}>
                            Shown for {cycleLabel} plan
                        </Text>
                        <View style={styles.benefitList}>
                            {pkg.packageBenefits && pkg.packageBenefits.length > 0 ? (
                                pkg.packageBenefits.map((pb: any, i: number) => {
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
                                (pkg.features || []).map((feature: string, i: number) => (
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
                            push('/(setup)/checkout', { packageId: pkg.type, durationMonths: selectedCycle });
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
        position: 'absolute', top: Platform.OS === 'ios' ? 50 : 20,
        left: 0, right: 0, zIndex: 10,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: scale(20)
    },
    headerBtn: { width: scale(40), height: scale(40), borderRadius: scale(20), backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontSize: scale(18), fontWeight: '700', color: '#FFFFFF' },

    heroSection: { paddingTop: scale(100), paddingBottom: scale(40), borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
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
