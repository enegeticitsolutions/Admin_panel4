import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Platform, Alert, TextInput, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Image } from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AddressPicker } from '../../components/ui/AddressPicker';
import { AddonCard } from '@/components/addons/AddonCard';
import * as Location from 'expo-location';
import { serviceabilityService } from '@/services/serviceability.service';
import { getAccurateLocation } from '@/services/location';

type PlanDuration = 'basic' | '6months' | 'annual';

import { API_URL } from '@/constants/api';
import { CallbackButton } from '../../components/CallbackButton';
import { WhatsAppButton } from '../../components/WhatsAppButton';
import { useSafeBack } from '@/hooks/useSafeBack';
import { useNavigationStack } from '@/contexts/NavigationStackContext';
import { useAndroidBackHandler } from '@/hooks/useAndroidBackHandler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';

export default function SubscriptionPackagesScreen() {
    const router = useRouter();
    const { beneficiaryId: paramBeneficiaryId, beneficiaryName: paramBeneficiaryName, tab: paramTab } = useLocalSearchParams<{
        beneficiaryId?: string;
        beneficiaryName?: string;
        tab?: string;
    }>();
    const { push } = useNavigationStack();
    const safeBack = useSafeBack();
    useAndroidBackHandler();
    const { role, isLoggedIn } = useAuth();
    const [menuOpen, setMenuOpen] = useState(false);
    const [packages, setPackages] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'care_mitra' | 'saathi' | 'all'>(
        paramTab === 'saathi' ? 'saathi' : paramTab === 'care_mitra' ? 'care_mitra' : 'all'
    );

    // Location targeting states
    const [selectedAddress, setSelectedAddress] = useState('');
    const [selectedPincode, setSelectedPincode] = useState('');
    const [selectedRegionId, setSelectedRegionId] = useState('');
    const [selectedLat, setSelectedLat] = useState<number | null>(null);
    const [selectedLng, setSelectedLng] = useState<number | null>(null);
    const [selectedCycle, setSelectedCycle] = useState<string>('12');

    const [mapModalVisible, setMapModalVisible] = useState(false);

    // Add-on selection step modal states
    const [showAddonSelectionModal, setShowAddonSelectionModal] = useState(false);
    const [selectedPackageForAddons, setSelectedPackageForAddons] = useState<any | null>(null);
    const [availableAddonsForPackage, setAvailableAddonsForPackage] = useState<any[]>([]);
    const [loadingAddons, setLoadingAddons] = useState(false);
    const [selectedAddonsMap, setSelectedAddonsMap] = useState<{ [benefitId: string]: { benefitId: string; name: string; unitLabel?: string; quantity: number; unitPrice: number; includedUnits: number } }>({});

    const [checkingPin, setCheckingPin] = useState(false);
    const [serviceMessage, setServiceMessage] = useState('');
    const [isServiceable, setIsServiceable] = useState<boolean | null>(null);

    const handleCheckLocation = async (lat?: number, lng?: number, pincode?: string) => {
        setCheckingPin(true);
        setServiceMessage('');
        setIsServiceable(null);
        try {
            const result = await serviceabilityService.checkLocation(lat, lng, pincode);
            
            if (result.isServiceable) {
                const regionId = result.region?.id || '';
                setServiceMessage(result.message || `Serving ${result.location}! Showing targeted packages.`);
                setIsServiceable(true);
                setSelectedAddress(result.location || `Pincode ${pincode || ''}`);
                if (pincode) setSelectedPincode(pincode);
                setSelectedRegionId(regionId);
                if (lat !== undefined && lng !== undefined) {
                    setSelectedLat(lat);
                    setSelectedLng(lng);
                }
                
                // Reload packages for this region
                const pkgRes = await fetch(`${API_URL}/subscriber/subscriptions/packages?regionId=${regionId}`);
                const pkgJson = await pkgRes.json();
                if (pkgJson.success) {
                    setPackages(pkgJson.data);
                }
            } else {
                setServiceMessage(result.message || "We don't serve this location yet. Showing global packages only.");
                setIsServiceable(false);
                setSelectedAddress(result.location || `Pincode ${pincode || ''}`);
                if (pincode) setSelectedPincode(pincode);
                setSelectedRegionId('');
                if (lat !== undefined && lng !== undefined) {
                    setSelectedLat(lat);
                    setSelectedLng(lng);
                }
                // Load global packages only
                const pkgRes = await fetch(`${API_URL}/subscriber/subscriptions/packages`);
                const pkgJson = await pkgRes.json();
                if (pkgJson.success) {
                    setPackages(pkgJson.data);
                }
            }
        } catch (err) {
            console.error("Error checking location:", err);
            Alert.alert("Error", "Could not check location serviceability.");
        } finally {
            setCheckingPin(false);
        }
    };

    const handleDirectDetectLocation = async () => {
        setCheckingPin(true);
        setServiceMessage('');
        setIsServiceable(null);
        try {
            const loc = await getAccurateLocation();
            const resolvedAddress = loc.address || [loc.city, loc.state].filter(Boolean).join(', ') || 'Current Location';
            setSelectedAddress(resolvedAddress);
            if (loc.pincode) setSelectedPincode(loc.pincode);
            
            await handleCheckLocation(loc.latitude, loc.longitude, loc.pincode);
        } catch (err) {
            console.error("Direct detect location failed:", err);
            Alert.alert("Error", "Failed to auto-detect your location. Please select it on the map.");
            setCheckingPin(false);
        }
    };

    useEffect(() => {
        const init = async () => {
            try {
                // Check auth status
                const token = await AsyncStorage.getItem('userToken');
                let userPincode = '';
                let defaultLat = 28.6139;
                let defaultLng = 77.2090;
                let hasCoords = false;

                if (token) {


                    // Load user profile to check for default coordinates
                    try {
                        const profileRes = await fetch(`${API_URL}/subscriber/profile`, {
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        const profileJson = await profileRes.json();
                        if (profileJson.success && profileJson.data?.user) {
                            const u = profileJson.data.user;
                            if (u.latitude && u.longitude) {
                                defaultLat = u.latitude;
                                defaultLng = u.longitude;
                                hasCoords = true;
                            } else if (u.pincode) {
                                userPincode = u.pincode;
                            }
                        }
                    } catch (e) {
                        console.warn('Profile fetch failed:', e);
                    }
                }

                if (hasCoords) {
                    await handleCheckLocation(defaultLat, defaultLng);
                } else if (userPincode) {
                    await handleCheckLocation(undefined, undefined, userPincode);
                } else {
                    // Fetch available packages globally
                    const response = await fetch(`${API_URL}/subscriber/subscriptions/packages`);
                    const json = await response.json();
                    if (json.success) {
                        setPackages(json.data);
                    }
                }
            } catch (err) {
                console.error('Failed to initialize packages screen:', err);
            } finally {
                setLoading(false);
            }
        };
        init();
    }, []);

    const fetchAddonsForSelection = async (regionId: string) => {
        setLoadingAddons(true);
        try {
            const token = await AsyncStorage.getItem('userToken');
            const query = regionId ? `?regionId=${regionId}` : '';
            const res = await fetch(`${API_URL}/subscriber/subscriptions/addons/available${query}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const json = await res.json();
            if (json.success) {
                setAvailableAddonsForPackage(json.data || []);
            }
        } catch (e) {
            console.warn('Failed to fetch addons:', e);
        } finally {
            setLoadingAddons(false);
        }
    };

    const handleSelectPackage = async (packageType: string) => {
        // Check if user is logged in
        const [token, isGuestStored] = await Promise.all([
            AsyncStorage.getItem('userToken'),
            AsyncStorage.getItem('isGuestSession')
        ]);
        if (!token || isGuestStored === 'true') {
            Alert.alert(
                "Account Required",
                "Please create an account or sign in to select a care package.",
                [
                    {
                        text: "Create Account",
                        onPress: () => router.push('/(auth)/register')
                    },
                    {
                        text: "Sign In",
                        onPress: () => router.push('/(auth)')
                    },
                    {
                        text: "Cancel",
                        style: "cancel"
                    }
                ]
            );
            return;
        }

        // Find the full package object
        const selectedPkg = packages.find(p => p.type === packageType);
        if (!selectedPkg) {
            Alert.alert("Error", "Package not found.");
            return;
        }

        setSelectedPackageForAddons(selectedPkg);
        setSelectedAddonsMap({});
        setShowAddonSelectionModal(true);
        await fetchAddonsForSelection(selectedRegionId);
    };

    const handleAddonQuantityChange = (addon: any, delta: number) => {
        const current = selectedAddonsMap[addon.id];
        const currentQty = current ? current.quantity : 0;
        const newQty = currentQty + delta;

        if (newQty <= 0) {
            const updated = { ...selectedAddonsMap };
            delete updated[addon.id];
            setSelectedAddonsMap(updated);
        } else {
            const unitP = addon.addonDiscountPrice ?? addon.addonPrice ?? 0;
            const incUnits = addon.addonIncludedUnits ?? 1;
            setSelectedAddonsMap({
                ...selectedAddonsMap,
                [addon.id]: {
                    benefitId: addon.id,
                    name: addon.name,
                    unitLabel: addon.unitLabel,
                    quantity: newQty,
                    unitPrice: unitP,
                    includedUnits: incUnits * newQty
                }
            });
        }
    };

    const handleProceedToCheckout = () => {
        if (!selectedPackageForAddons) return;

        const selectedAddonsPayload = Object.values(selectedAddonsMap);

        setShowAddonSelectionModal(false);

        // For trial packages, duration is fixed by trialDurationDays on the backend.
        // Pass durationMonths=1 as a safe default; the API will use days instead.
        const effectiveDuration = selectedPackageForAddons.isFreeTrial ? '1' : selectedCycle;

        push('/(setup)/checkout', { 
            packageId: selectedPackageForAddons.id, 
            serviceRegionId: selectedRegionId,
            servicePincode: selectedPincode,
            serviceAddress: JSON.stringify(selectedAddress),
            serviceLat: selectedLat ? String(selectedLat) : '',
            serviceLng: selectedLng ? String(selectedLng) : '',
            selectedAddons: JSON.stringify(selectedAddonsPayload),
            // Duration: number of months selected on the packages screen (1 for trial packages)
            durationMonths: effectiveDuration,
            ...(typeof paramBeneficiaryId === 'string' && paramBeneficiaryId ? { beneficiaryId: paramBeneficiaryId } : {}),
            ...(typeof paramBeneficiaryName === 'string' && paramBeneficiaryName ? { beneficiaryName: paramBeneficiaryName } : {}),
        });
    };

    const calculatePackagePrice = (pkg: any, cycleKey: string) => {
        if (!pkg) return 0;
        const base = pkg.basePrice || 0;
        if (pkg.isFreeTrial) return base;
        const durNum = parseInt(cycleKey, 10);
        if (durNum === 1) {
            return pkg.priceOneMonth ? pkg.priceOneMonth : base;
        } else if (durNum === 3) {
            const disc = pkg.discountThreeMonths ?? 5;
            return pkg.priceThreeMonths ? pkg.priceThreeMonths : Math.round(base * 3 * (1 - disc / 100));
        } else if (durNum === 6) {
            const disc = pkg.discountSixMonths ?? 10;
            return pkg.priceSixMonths ? pkg.priceSixMonths : Math.round(base * 6 * (1 - disc / 100));
        } else if (durNum === 12) {
            const disc = pkg.discountAnnual ?? 20;
            return pkg.priceTwelveMonths ? pkg.priceTwelveMonths : Math.round(base * 12 * (1 - disc / 100));
        }
        return base;
    };

    const getPrice = (pkg: any) => {
        return calculatePackagePrice(pkg, selectedCycle);
    };

    const discount6m = packages[0]?.discountSixMonths || 10;
    const discountAnnual = packages[0]?.discountAnnual || 20;

    const isSaathiPackage = (pkg: any): boolean => {
        const nameLower = (pkg?.name || '').toLowerCase();
        const typeLower = (pkg?.type || '').toLowerCase();
        if (nameLower.includes('saathi') || nameLower.includes('sathi') || typeLower.includes('saathi') || typeLower.includes('sathi')) {
            return true;
        }
        const benefits = pkg?.packageBenefits || pkg?.benefits || [];
        return benefits.some((pb: any) => {
            const bName = (pb?.benefit?.name || '').toLowerCase();
            const bCode = (pb?.benefit?.code || '').toUpperCase();
            return pb?.benefitId === 'sathi-companion-benefit' || bName.includes('saathi') || bName.includes('sathi') || bCode.includes('SATHI');
        });
    };

    const filteredPackages = packages.filter((pkg: any) => {
        if (activeTab === 'all') return true;
        const saathi = isSaathiPackage(pkg);
        return activeTab === 'saathi' ? saathi : !saathi;
    });

    const formatBenefitUnitLabel = (rawUnit: string, count: number): string => {
        const clean = (rawUnit || '').replace(/^per\s+/i, '').trim();
        if (!clean) return '';
        const lower = clean.toLowerCase();
        if (lower === 'hour' || lower === 'hours' || lower === 'hr' || lower === 'hrs') {
            return count > 1 ? ' Visit Hours' : ' Visit Hour';
        }
        const capitalized = clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
        const plural = count > 1 && !lower.endsWith('s') ? 's' : '';
        return ` ${capitalized}${plural}`;
    };

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            {/* Subtle top-right warm radial glow */}
            <View style={styles.topGlow} pointerEvents="none" />

            {/* Floating Rounded PageHeader */}
            <View style={styles.headerOuter}>
                <View style={styles.headerCard}>
                    <TouchableOpacity style={styles.headerIconBtn} onPress={() => safeBack()} activeOpacity={0.75}>
                        <Ionicons name="arrow-back" size={22} color="#1F2937" />
                    </TouchableOpacity>

                    <Text style={styles.headerTitle} numberOfLines={1}>Subscription Packages</Text>

                    <TouchableOpacity
                        style={styles.headerIconBtn}
                        onPress={() => setMenuOpen(v => !v)}
                        activeOpacity={0.75}
                    >
                        <Ionicons name="menu" size={23} color="#1F2937" />
                    </TouchableOpacity>
                </View>

                {/* Dropdown */}
                {menuOpen && (
                    <View style={styles.menuDropdown}>
                        {isLoggedIn ? (
                            <>
                                <TouchableOpacity
                                    style={styles.menuItem}
                                    onPress={() => { setMenuOpen(false); router.replace('/(beneficiary)' as any); }}
                                >
                                    <Ionicons name="home-outline" size={20} color="#111827" />
                                    <Text style={styles.menuItemText}>Dashboard</Text>
                                </TouchableOpacity>
                                <View style={styles.menuDivider} />
                                <TouchableOpacity
                                    style={styles.menuItem}
                                    onPress={() => { setMenuOpen(false); router.push('/(subscriber)/profile' as any); }}
                                >
                                    <Ionicons name="person-outline" size={20} color="#111827" />
                                    <Text style={styles.menuItemText}>My Profile</Text>
                                </TouchableOpacity>
                            </>
                        ) : (
                            <TouchableOpacity
                                style={[styles.menuItem, { backgroundColor: '#FE6700', justifyContent: 'center' }]}
                                onPress={() => { setMenuOpen(false); router.push('/(auth)' as any); }}
                            >
                                <Text style={[styles.menuItemText, { color: '#FFFFFF', fontWeight: 'bold' }]}>Login</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Hero Heading */}
                <View style={styles.headerArea}>
                    <Text style={styles.eyebrowText}>FLEXIBLE CARE</Text>
                    <Text style={styles.mainTitle}>Choose the Right Care for Your Loved Ones</Text>
                    <Text style={styles.subTitle}>Personalized plans designed for peace of mind.</Text>
                </View>

                {/* Location Card */}
                <View style={styles.locationContainer}>
                    <View style={styles.locationTopRow}>
                        <View style={styles.locationIconBox}>
                            <Ionicons name="location-outline" size={23} color="#FE6700" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.locationTitle}>See packages serving in desired location</Text>
                            {selectedAddress ? (
                                <Text style={styles.selectedAddressText} numberOfLines={2}>
                                    {selectedAddress}
                                </Text>
                            ) : (
                                <Text style={styles.noLocationText}>No location selected yet.</Text>
                            )}
                        </View>
                    </View>

                    <View style={styles.actionButtonStack}>
                        <TouchableOpacity
                            style={styles.detectLocationBtn}
                            onPress={handleDirectDetectLocation}
                            disabled={checkingPin}
                            activeOpacity={0.85}
                        >
                            <Ionicons name="locate-outline" size={19} color="#FFF" />
                            <Text style={styles.pickLocationBtnText}>Detect Location</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.pickLocationBtn}
                            onPress={() => setMapModalVisible(true)}
                            activeOpacity={0.85}
                        >
                            <Ionicons name="map-outline" size={19} color="#FFF" />
                            <Text style={styles.pickLocationBtnText}>Pick on Map</Text>
                        </TouchableOpacity>
                    </View>

                    {serviceMessage ? (
                        <Text style={[
                            styles.serviceMessage,
                            isServiceable ? styles.serviceSuccess : styles.serviceFail
                        ]}>
                            {serviceMessage}
                        </Text>
                    ) : null}
                </View>

                {/* 3 Package Category Tabs */}
                <View style={styles.categoryTabList}>
                    {[
                        { key: 'care_mitra' as const, label: 'Care Mitra\nPackages' },
                        { key: 'saathi' as const, label: 'Saathi\nPackages' },
                        { key: 'all' as const, label: 'All\nPackages' },
                    ].map((tab) => {
                        const isActive = activeTab === tab.key;
                        return (
                            <TouchableOpacity
                                key={tab.key}
                                onPress={() => setActiveTab(tab.key)}
                                style={[styles.categoryTabBtn, isActive && styles.categoryTabBtnActive]}
                                activeOpacity={0.85}
                            >
                                <Text
                                    style={[styles.categoryTabText, isActive && styles.categoryTabTextActive]}
                                    numberOfLines={2}
                                >
                                    {tab.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Dynamic DB Driven Cards (Yearly Per-Month Pricing) */}
                {loading && packages.length === 0 ? (
                    <View style={styles.emptyPackagesCard}>
                        <ActivityIndicator size="large" color="#FE6700" />
                        <Text style={styles.emptyPackagesSub}>Loading care packages...</Text>
                    </View>
                ) : filteredPackages.length === 0 ? (
                    <View style={styles.emptyPackagesCard}>
                        <Ionicons name="albums-outline" size={32} color="#9CA3AF" />
                        <Text style={styles.emptyPackagesTitle}>No packages in this category</Text>
                        <Text style={styles.emptyPackagesSub}>
                            Try switching to All Packages or picking another location.
                        </Text>
                    </View>
                ) : filteredPackages.map((pkg: any) => {
                    const isPopular = pkg.isPopular;
                    const isTrial = !!pkg.isFreeTrial;

                    const base = pkg.basePrice || 0;
                    let displayMonthlyPrice = base;
                    let mainUnit = '/mo';
                    let totalSubtext = '';

                    if (isTrial) {
                        displayMonthlyPrice = base;
                        mainUnit = `/ ${pkg.trialDurationDays ?? 7} days`;
                        totalSubtext = '';
                    } else {
                        const disc = pkg.discountAnnual ?? 20;
                        const yearlyTotal = pkg.priceTwelveMonths
                            ? pkg.priceTwelveMonths
                            : Math.round(base * 12 * (1 - disc / 100));
                        displayMonthlyPrice = Math.round(yearlyTotal / 12);
                        mainUnit = '/mo';
                        totalSubtext = `(₹${yearlyTotal.toLocaleString('en-IN')} for 1 yr)`;
                    }

                    return (
                        <View
                            key={pkg.id}
                            style={[
                                styles.card,
                                isPopular ? styles.popularCard : styles.standardCard,
                            ]}
                        >
                            {isTrial ? (
                                <View style={styles.popularRibbon}>
                                    <Text style={styles.popularRibbonText}>
                                        {pkg.trialDurationDays ?? 7}-DAY TRIAL
                                    </Text>
                                </View>
                            ) : isPopular ? (
                                <View style={styles.popularRibbon}>
                                    <Text style={styles.popularRibbonText}>MOST POPULAR</Text>
                                </View>
                            ) : null}

                            <View style={styles.cardHeaderRow}>
                                <View style={{ flex: 1, paddingRight: 12 }}>
                                    <Text style={styles.planName}>{pkg.name}</Text>
                                    <View style={styles.priceRow}>
                                        <Text style={styles.priceValue}>
                                            ₹{displayMonthlyPrice.toLocaleString('en-IN')}
                                        </Text>
                                        <Text style={styles.priceUnit}>{mainUnit}</Text>
                                        {totalSubtext ? (
                                            <Text style={styles.priceSubtext}>{totalSubtext}</Text>
                                        ) : null}
                                    </View>
                                </View>

                                <View style={styles.heartBadge}>
                                    <Ionicons name="heart-outline" size={28} color="#E0587F" />
                                </View>
                            </View>

                            <View style={styles.featureList}>
                                {[...(pkg.packageBenefits || [])].sort((a: any, b: any) => {
                                    const getPri = (x: any) => {
                                        const cat = x.category || ((x.benefit?.name || '').toLowerCase().includes('facilitation') || (x.benefit?.name || '').toLowerCase().includes('coordination') ? 'arranged' : 'included');
                                        return cat === 'included' ? 1 : cat === 'addon' ? 2 : 3;
                                    };
                                    const priDiff = getPri(a) - getPri(b);
                                    if (priDiff !== 0) return priDiff;

                                    const showA = a.showUnit !== false;
                                    const showB = b.showUnit !== false;
                                    if (showA && !showB) return -1;
                                    if (!showA && showB) return 1;

                                    if (showA && showB) {
                                        if (a.isUnlimited && !b.isUnlimited) return -1;
                                        if (!a.isUnlimited && b.isUnlimited) return 1;
                                        const uA = Number(a.unitsIncluded) || 0;
                                        const uB = Number(b.unitsIncluded) || 0;
                                        if (uB !== uA) return uB - uA;
                                    }
                                    return 0;
                                }).map((pb: any, fIdx: number) => {
                                    const baseUnit = pb.unitsIncluded ?? 0;
                                    const formattedLabel = formatBenefitUnitLabel(pb.benefit?.unitLabel || '', baseUnit);

                                    const rawName = pb.benefit?.name || '';
                                    const formattedName = rawName.replace(/\b\w/g, (char: string) => char.toUpperCase()).replace(/\B\w/g, (char: string) => char.toLowerCase());

                                    const period = pb.unitsPeriod || 'monthly';
                                    let periodText = '';
                                    if (period === 'monthly') periodText = '/month';
                                    else if (period === 'yearly') periodText = '/year';
                                    else if (period === '3_months') periodText = '/quarter';
                                    else if (period === '6_months') periodText = '/half-year';
                                    else if (period === 'one_time') periodText = ' (once)';

                                    return (
                                        <View key={fIdx} style={styles.featureRow}>
                                            <View style={styles.checkCircle}>
                                                <Ionicons name="checkmark" size={13} color="#FFFFFF" />
                                            </View>
                                            <Text style={styles.featureText}>
                                                {pb.showUnit !== false ? (
                                                    <Text style={styles.featureTextBold}>
                                                        {pb.isUnlimited ? 'Unlimited' : `${baseUnit}${formattedLabel}${periodText}`}{' • '}
                                                    </Text>
                                                ) : null}
                                                {formattedName}
                                            </Text>
                                        </View>
                                    );
                                })}
                            </View>

                            <View style={styles.cardActions}>
                                <TouchableOpacity
                                    style={styles.detailsBtn}
                                    onPress={() =>
                                        router.push({
                                            pathname: `/(subscriber)/package-details/${pkg.type}`,
                                            params: {
                                                cycle: '12',
                                                ...(typeof paramBeneficiaryId === 'string' && paramBeneficiaryId ? { beneficiaryId: paramBeneficiaryId } : {}),
                                                ...(typeof paramBeneficiaryName === 'string' && paramBeneficiaryName ? { beneficiaryName: paramBeneficiaryName } : {}),
                                            },
                                        })
                                    }
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.detailsBtnText}>View Details</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.selectBtnOutline}
                                    onPress={() => handleSelectPackage(pkg.type)}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.selectBtnOutlineText}>Select</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    );
                })}



                {/* How It Works Section */}
                <View style={styles.howItWorksContainer}>
                    <Text style={styles.sectionTitle}>How It Works</Text>

                    <View style={styles.stepContainer}>
                        <View style={styles.stepBadge}><Text style={styles.stepNumber}>1</Text></View>
                        <Text style={styles.stepTitle}>Choose Package</Text>
                        <Text style={styles.stepSub}>Select the care plan that suits your needs</Text>
                    </View>

                    <View style={styles.stepContainer}>
                        <View style={styles.stepBadge}><Text style={styles.stepNumber}>2</Text></View>
                        <Text style={styles.stepTitle}>Add Details</Text>
                        <Text style={styles.stepSub}>Provide beneficiary and medical information</Text>
                    </View>

                    <View style={styles.stepContainer}>
                        <View style={styles.stepBadge}><Text style={styles.stepNumber}>3</Text></View>
                        <Text style={styles.stepTitle}>Schedule Visits</Text>
                        <Text style={styles.stepSub}>Set preferred timings for care companion visits</Text>
                    </View>

                    <View style={styles.stepContainer}>
                        <View style={styles.stepBadge}><Text style={styles.stepNumber}>4</Text></View>
                        <Text style={styles.stepTitle}>Start Care</Text>
                        <Text style={styles.stepSub}>Begin receiving professional care services</Text>
                    </View>
                </View>

                {/* Need Assistance Section */}
                <View style={styles.assistanceCard}>
                    <View style={styles.assistanceHeader}>
                        <View style={styles.assistanceIllustration}>
                            <Image
                                source={require("../../assets/images/group4.png")}
                                style={{ width: 50, height: 50 }}
                            />
                        </View>
                        <View style={{ flex: 1, marginLeft: 15 }}>
                            <Text style={styles.assistanceTitle}>Need assistance?</Text>
                            <Text style={styles.assistanceSub}>Our experts are here to help you choose the right plan via Phone.</Text>
                        </View>
                    </View>

                    <View style={styles.assistanceActions}>
                        <CallbackButton
                            style={styles.callbackBtn}
                            textStyle={styles.callbackText}
                            notes="Requested assistance from Subscription Packages page"
                        />
                        <WhatsAppButton
                            variant="icon"
                            style={styles.whatsappBtn}
                            iconSize={26}
                            iconColor="#25D366"
                            message="Hello! I need assistance choosing a subscription plan on MaiHoonNa."
                        />
                    </View>
                </View>
            </ScrollView>

            {/* Address Picker Modal */}
            {mapModalVisible && (
                <Modal visible={mapModalVisible} animationType="slide" transparent={false}>
                    <AddressPicker
                        onAddressSelected={(selected) => {
                            setMapModalVisible(false);
                            setSelectedAddress(selected.address);
                            setSelectedPincode(selected.pincode || '');
                            setSelectedLat(selected.latitude);
                            setSelectedLng(selected.longitude);
                            handleCheckLocation(selected.latitude, selected.longitude);
                        }}
                        onCancel={() => setMapModalVisible(false)}
                        title="Set Accurate Location"
                        subtitle="Move the pin to your exact location"
                    />
                </Modal>
            )}
            {/* ── Add-ons Customization Step Modal ── */}
            <Modal
                visible={showAddonSelectionModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowAddonSelectionModal(false)}
            >
                <View style={styles.addonStepModalOverlay}>
                    <View style={styles.addonStepModalContent}>
                        {/* Header */}
                        <View style={styles.addonStepHeader}>
                            <View>
                                <Text style={styles.addonStepTitle}>Customize Your Plan</Text>
                                <Text style={styles.addonStepSubTitle}>Select optional add-on benefits for your package</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowAddonSelectionModal(false)} style={styles.closeBtnCircle}>
                                <Ionicons name="close" size={18} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }}>
                            {/* Selected Package Banner */}
                            {selectedPackageForAddons && (
                                <View style={styles.selectedPkgBanner}>
                                    <View style={styles.selectedPkgIconCircle}>
                                        <Ionicons name="cube-outline" size={20} color="#FF5B0A" />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.selectedPkgName}>
                                            {selectedPackageForAddons.name} {selectedPackageForAddons.isFreeTrial 
                                                ? `(${selectedPackageForAddons.trialDurationDays ?? 30}-Day Trial)` 
                                                : `(${selectedCycle === '12' ? '1 Year' : selectedCycle === '6' ? '6 Months' : selectedCycle === '1' ? '1 Month' : '3 Months'})`}
                                        </Text>
                                        <Text style={styles.selectedPkgBenefitsCount}>
                                            {selectedPackageForAddons.packageBenefits?.length || 3} Standard Benefits Included · ₹{calculatePackagePrice(selectedPackageForAddons, selectedCycle).toLocaleString('en-IN')}
                                        </Text>
                                    </View>
                                </View>
                            )}

                            <View style={{ marginBottom: 12 }}>
                                <Text style={styles.addonsListHeaderTitle}>Available Add-on Benefits</Text>
                                <Text style={styles.addonsListHeaderSub}>
                                    {selectedRegionId ? 'Location-matched & global add-on options' : 'Select optional benefit top-ups'}
                                </Text>
                            </View>

                            {loadingAddons ? (
                                <View style={{ paddingVertical: 30, alignItems: 'center' }}>
                                    <ActivityIndicator size="small" color="#FF5B0A" />
                                    <Text style={{ marginTop: 8, fontSize: 13, color: '#6B7280' }}>Loading add-ons...</Text>
                                </View>
                            ) : availableAddonsForPackage.length === 0 ? (
                                <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                                    <Text style={{ color: '#6B7280', fontSize: 13 }}>No add-ons available at this time.</Text>
                                </View>
                            ) : (
                                availableAddonsForPackage.map((addon) => {
                                    const currentItem = selectedAddonsMap[addon.id];
                                    const qty = currentItem ? currentItem.quantity : 0;

                                    return (
                                        <AddonCard
                                            key={addon.id}
                                            addon={addon}
                                            selectedQuantity={qty}
                                            onQuantityChange={handleAddonQuantityChange}
                                        />
                                    );
                                })
                            )}
                        </ScrollView>

                        {/* Dynamic Summary Bar & Checkout Button */}
                        {selectedPackageForAddons && (
                            <View style={styles.addonSummaryFooter}>
                                <View style={styles.summaryStatsRow}>
                                    <View style={{ flex: 1, marginRight: 10 }}>
                                        <Text style={styles.summaryBenefitsLabel}>TOTAL PACKAGE COVERAGE</Text>
                                        <Text style={styles.summaryBenefitsCount}>
                                            {(selectedPackageForAddons.packageBenefits?.length || 3) + Object.keys(selectedAddonsMap).length} Total Benefits Included
                                        </Text>
                                    </View>

                                    <View style={{ alignItems: 'flex-end' }}>
                                        <Text style={styles.summaryPriceLabel}>TOTAL PRICE</Text>
                                        <Text style={styles.summaryPriceValue}>
                                            ₹{(calculatePackagePrice(selectedPackageForAddons, selectedCycle) + Object.values(selectedAddonsMap).reduce((sum: number, item: any) => sum + (item.unitPrice * item.quantity), 0)).toLocaleString('en-IN')}
                                        </Text>
                                    </View>
                                </View>

                                <TouchableOpacity
                                    style={styles.proceedCheckoutBtn}
                                    onPress={handleProceedToCheckout}
                                    activeOpacity={0.85}
                                >
                                    <Text style={styles.proceedCheckoutBtnText}>
                                        {Object.keys(selectedAddonsMap).length > 0
                                            ? `Proceed with Add-ons (${(selectedPackageForAddons.packageBenefits?.length || 3) + Object.keys(selectedAddonsMap).length} Benefits)`
                                            : 'Proceed to Checkout'}
                                    </Text>
                                    <Ionicons name="arrow-forward" size={16} color="#FFFFFF" style={{ marginLeft: 6 }} />
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#FAF3EB' },
    topGlow: {
        position: 'absolute',
        top: -60,
        right: -40,
        width: 240,
        height: 240,
        borderRadius: 120,
        backgroundColor: 'rgba(255, 122, 0, 0.09)',
    },
    scrollContent: { paddingHorizontal: 22, paddingBottom: 48 },

    headerOuter: {
        paddingHorizontal: 22,
        paddingTop: 10,
        paddingBottom: 6,
        zIndex: 20,
    },
    headerCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(255, 255, 255, 0.92)',
        borderWidth: 0.8,
        borderColor: '#E7DED6',
        borderRadius: 22,
        minHeight: 74,
        paddingHorizontal: 10,
        shadowColor: '#4A3625',
        shadowOffset: { width: 0, height: 9 },
        shadowOpacity: 0.06,
        shadowRadius: 28,
        elevation: 4,
    },
    headerIconBtn: {
        width: 44,
        height: 44,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontFamily: 'Poppins-Bold',
        fontSize: 18,
        fontWeight: '700',
        color: '#1F2937',
        letterSpacing: -0.45,
        flex: 1,
        textAlign: 'center',
    },

    headerArea: { paddingTop: 18, paddingHorizontal: 4, marginBottom: 22 },
    eyebrowText: {
        fontFamily: 'Poppins-Bold',
        fontSize: 11,
        fontWeight: '700',
        lineHeight: 14,
        letterSpacing: 1.21,
        color: '#C9530B',
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    mainTitle: {
        fontFamily: 'Poppins-Bold',
        fontSize: 27,
        fontWeight: '700',
        color: '#1F2937',
        lineHeight: 31,
        letterSpacing: -0.945,
        marginBottom: 8,
    },
    subTitle: {
        fontFamily: 'Poppins-Regular',
        fontSize: 14,
        lineHeight: 21,
        color: '#6B7280',
    },

    toggleContainer: {
        flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 30, padding: 4,
        marginBottom: 30, borderWidth: 1, borderColor: '#FDE6D5', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4
    },
    toggleBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 26 },
    toggleBtnActive: { backgroundColor: '#F97316' },
    toggleText: { fontSize: 13, fontWeight: '600', color: '#4B5563' },
    toggleTextActive: { color: '#FFFFFF' },
    discountText: { fontSize: 9, color: '#9CA3AF' },
    discountTextActive: { fontSize: 9, color: '#FFD6BA' },

    headerWrapper: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
        zIndex: 10,
    },
    menuDropdown: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#F3F4F6',
        marginTop: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 6,
        overflow: 'hidden',
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 14,
        gap: 14,
    },
    menuItemText: {
        fontSize: 15,
        fontWeight: '500',
        color: '#111827',
        fontFamily: 'Poppins-Medium',
    },
    menuDivider: {
        height: 1,
        backgroundColor: '#F3F4F6',
        marginHorizontal: 16,
    },

    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 25,
        paddingHorizontal: 20,
        paddingVertical: 23,
        marginBottom: 20,
        shadowColor: '#4A3625',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.06,
        shadowRadius: 28,
        elevation: 3,
        position: 'relative',
    },
    standardCard: {
        borderWidth: 0.8,
        borderColor: '#DFD8D2',
    },
    popularCard: {
        borderWidth: 0.8,
        borderColor: '#FFC79F',
    },
    popularRibbon: {
        position: 'absolute',
        top: 0,
        right: 26,
        backgroundColor: '#FE6700',
        paddingHorizontal: 11,
        paddingVertical: 5,
        borderBottomLeftRadius: 10,
        borderBottomRightRadius: 10,
        zIndex: 3,
    },
    popularRibbonText: {
        fontFamily: 'Poppins-Bold',
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '700',
        lineHeight: 15,
        textTransform: 'uppercase',
    },
    cardHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 18,
    },
    planName: {
        fontFamily: 'Poppins-Bold',
        fontSize: 20,
        fontWeight: '700',
        lineHeight: 30,
        color: '#1F2937',
        marginBottom: 4,
    },
    priceRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 4 },
    priceValue: {
        fontFamily: 'Poppins-Bold',
        fontSize: 26,
        fontWeight: '700',
        lineHeight: 36,
        color: '#1F2937',
    },
    priceUnit: {
        fontFamily: 'Poppins-Bold',
        fontSize: 14,
        fontWeight: '700',
        color: '#1F2937',
    },
    priceSubtext: {
        fontFamily: 'Poppins-Bold',
        fontSize: 12,
        fontWeight: '700',
        color: '#7D828B',
        marginLeft: 4,
    },
    heartBadge: {
        width: 68,
        height: 68,
        backgroundColor: '#FFE7D6',
        borderTopLeftRadius: 34,
        borderTopRightRadius: 30.6,
        borderBottomRightRadius: 37.4,
        borderBottomLeftRadius: 28.56,
        alignItems: 'center',
        justifyContent: 'center',
    },

    featureList: { marginBottom: 24, gap: 12 },
    featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    checkCircle: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: '#169A8E',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 1,
    },
    featureText: {
        fontFamily: 'Poppins-Regular',
        fontSize: 14,
        lineHeight: 21,
        color: '#6B7280',
        flex: 1,
    },
    featureTextBold: {
        fontFamily: 'Poppins-Bold',
        fontWeight: '700',
        color: '#1F2937',
    },

    cardActions: { flexDirection: 'row', gap: 8 },
    detailsBtn: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderWidth: 0.8,
        borderColor: '#15988D',
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
        height: 48,
    },
    detailsBtnText: {
        fontFamily: 'Poppins-Bold',
        color: '#128F83',
        fontSize: 13,
        fontWeight: '700',
    },
    selectBtnOutline: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderWidth: 0.8,
        borderColor: '#15988D',
        height: 48,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
    },
    selectBtnOutlineText: {
        fontFamily: 'Poppins-Bold',
        color: '#128F83',
        fontSize: 13,
        fontWeight: '700',
    },
    categoryTabList: {
        flexDirection: 'row',
        backgroundColor: '#F0F3F8',
        borderWidth: 0.8,
        borderColor: '#DCE1E9',
        borderRadius: 19,
        padding: 5,
        marginBottom: 22,
        gap: 4,
    },
    categoryTabBtn: {
        flex: 1,
        minHeight: 54,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 6,
        paddingVertical: 8,
    },
    categoryTabBtnActive: {
        backgroundColor: '#FE6700',
        shadowColor: '#EB5800',
        shadowOffset: { width: 0, height: 7 },
        shadowOpacity: 0.19,
        shadowRadius: 16,
        elevation: 4,
    },
    categoryTabText: {
        fontFamily: 'Poppins-Bold',
        fontSize: 11,
        fontWeight: '700',
        lineHeight: 15,
        textAlign: 'center',
        color: '#1F2937',
    },
    categoryTabTextActive: {
        color: '#FFFFFF',
    },
    emptyPackagesCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 28,
        alignItems: 'center',
        borderWidth: 0.8,
        borderColor: '#E7DED6',
        marginBottom: 24,
    },
    emptyPackagesTitle: {
        fontFamily: 'Poppins-Bold',
        fontSize: 16,
        fontWeight: '700',
        color: '#1F2937',
        marginTop: 10,
        marginBottom: 4,
    },
    emptyPackagesSub: {
        fontFamily: 'Poppins-Regular',
        fontSize: 13,
        color: '#6B7280',
        textAlign: 'center',
    },

    // How it Works Styles
    howItWorksContainer: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24, marginBottom: 24 },
    sectionTitle: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 24 },
    stepContainer: { alignItems: 'center', marginBottom: 24 },
    stepBadge: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F97316', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
    stepNumber: { color: '#FFF', fontWeight: '700', fontSize: 16 },
    stepTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 4 },
    stepSub: { fontSize: 13, color: '#6B7280', textAlign: 'center', paddingHorizontal: 20 },

    // Assistance Card Styles
    assistanceCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, marginBottom: 20 },
    assistanceHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    assistanceIllustration: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
    assistanceTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 4 },
    assistanceSub: { fontSize: 16, color: '#4B5563', lineHeight: 18 },
    assistanceActions: { flexDirection: 'row', alignItems: 'center' },
    callbackBtn: { flex: 1, flexDirection: 'row', borderWidth: 1, borderColor: '#F97316', borderRadius: 12, height: 50, alignItems: 'center', justifyContent: 'center' },
    callbackText: { color: '#F97316', fontWeight: '600', fontSize: 15 },
    whatsappBtn: {
        width: 50, height: 50, borderRadius: 12, backgroundColor: '#F0FDF4',
        borderWidth: 1, borderColor: '#DCFCE7',
        justifyContent: 'center', alignItems: 'center', marginLeft: 10,
    },

    // Location picker styles
    locationContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 20,
        marginBottom: 22,
        borderWidth: 0.8,
        borderColor: '#E7DED6',
        shadowColor: '#4A3625',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.06,
        shadowRadius: 28,
        elevation: 3,
    },
    locationTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        marginBottom: 18,
    },
    locationIconBox: {
        width: 46,
        height: 46,
        borderRadius: 15,
        backgroundColor: '#FFF4EC',
        alignItems: 'center',
        justifyContent: 'center',
    },
    locationTitle: {
        fontFamily: 'Poppins-Bold',
        fontSize: 16,
        fontWeight: '700',
        lineHeight: 23,
        color: '#1F2937',
        marginBottom: 4,
    },
    selectedAddressText: {
        fontFamily: 'Poppins-Medium',
        fontSize: 13,
        color: '#4B5563',
        lineHeight: 19,
    },
    noLocationText: {
        fontFamily: 'Poppins-Regular',
        fontSize: 13,
        color: '#9A9FA7',
        fontStyle: 'italic',
        lineHeight: 19,
    },
    actionButtonStack: {
        gap: 8,
    },
    detectLocationBtn: {
        width: '100%',
        backgroundColor: '#11B985',
        borderRadius: 15,
        height: 48,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
    },
    pickLocationBtn: {
        width: '100%',
        backgroundColor: '#FF7A00',
        borderRadius: 15,
        height: 48,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
        shadowColor: '#EF5C00',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.16,
        shadowRadius: 18,
        elevation: 3,
    },
    pickLocationBtnText: {
        fontFamily: 'Poppins-Bold',
        color: '#FFFFFF',
        fontWeight: '700',
        fontSize: 13,
    },
    serviceMessage: {
        fontSize: 13,
        fontWeight: '600',
        marginTop: 10
    },
    serviceSuccess: {
        color: '#10B981'
    },
    serviceFail: {
        color: '#EF4444'
    },

    // Regional package styles
    regionalCard: {
        borderColor: '#F97316',
        borderWidth: 1.5,
        backgroundColor: '#FFF5ED'
    },
    regionalBadge: {
        position: 'absolute',
        top: -14,
        alignSelf: 'center',
        backgroundColor: '#F97316',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center'
    },
    regionalBadgeText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '700'
    },
    planPriceRegional: {
        fontSize: 28,
        fontWeight: '800',
        color: '#F97316'
    },
    selectBtnSolidRegional: {
        backgroundColor: '#F97316'
    },
    selectBtnOutlineRegional: {
        borderColor: '#F97316'
    },
    selectBtnOutlineTextRegional: {
        color: '#F97316'
    },
    detailsBtnTextRegional: {
        color: '#F97316'
    },
    detailsBtnRegional: {
        borderColor: '#F97316'
    },

    // Add-on selection modal styles (Minimalist Design)
    addonStepModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.4)',
        justifyContent: 'flex-end'
    },
    addonStepModalContent: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        height: '85%',
        paddingTop: 20,
        paddingHorizontal: 20,
        paddingBottom: 10,
    },
    addonStepHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        paddingBottom: 14,
        marginBottom: 16
    },
    addonStepTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#0F172A',
    },
    addonStepSubTitle: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 2
    },
    closeBtnCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center'
    },
    selectedPkgBanner: {
        backgroundColor: '#F8FAFC',
        borderRadius: 14,
        padding: 14,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 18,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    selectedPkgIconCircle: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#FFF3ED',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12
    },
    selectedPkgName: {
        fontSize: 15,
        fontWeight: '700',
        color: '#0F172A',
        marginBottom: 2
    },
    selectedPkgBenefitsCount: {
        fontSize: 12,
        color: '#64748B'
    },
    addonsListHeaderTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#0F172A',
    },
    addonsListHeaderSub: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 2
    },
    addonSummaryFooter: {
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        paddingTop: 14,
        paddingBottom: Platform.OS === 'ios' ? 24 : 14,
        backgroundColor: '#FFFFFF'
    },
    summaryStatsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12
    },
    summaryBenefitsLabel: {
        fontSize: 10,
        color: '#94A3B8',
        fontWeight: '700',
        letterSpacing: 0.6,
        marginBottom: 2
    },
    summaryBenefitsCount: {
        fontSize: 13,
        fontWeight: '700',
        color: '#0F172A'
    },
    summaryPriceLabel: {
        fontSize: 10,
        color: '#94A3B8',
        fontWeight: '700',
        letterSpacing: 0.6,
        marginBottom: 2
    },
    summaryPriceValue: {
        fontSize: 20,
        fontWeight: '800',
        color: '#FF5B0A',
    },
    proceedCheckoutBtn: {
        backgroundColor: '#FF5B0A',
        borderRadius: 14,
        height: 48,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    proceedCheckoutBtnText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
    }
});
